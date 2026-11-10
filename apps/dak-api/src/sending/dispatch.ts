            providerMessageId: messageId!,
            submittedAt: now,
            statusAt: now,
          },
          and(
            inArray(events.emailRecipient.id, liveIds),
            eq(events.emailRecipient.deliveryStatus, 'pending'),
          ),
        ),
        ev.update(events.email, { status: 'sent' }, eq(events.email.id, email.id)),
        ev.delete(events.outbox, eq(events.outbox.emailId, email.id)),
      ])
      await event(ctx, email.id, 'submitted', {
        providerMessageId: messageId,
        latencyMs,
        attempt: attemptNo,
      })
      await hook(ctx, email, 'email.submitted', { recipients: live.map((r) => r.address) })
      if (!project.retainBodies && email.payloadKey) await ctx.env.BLOBS.delete(email.payloadKey)
      return { action: 'ack', result: 'submitted' }

    case 'rejected': {
      const n = await settlePending(ctx, email, 'rejected')
      await ev.update(events.email, { status: 'failed' }, eq(events.email.id, email.id))
      await release(ctx, email, n)
      await event(ctx, email.id, 'rejected', { ...error, latencyMs })
      await hook(ctx, email, 'email.rejected', { reason: error?.message })
      await finish(ctx, email.id)
      return { action: 'ack', result: 'rejected' }
    }

    case 'throttled': {
      await ev.update(events.email, { status: 'queued' }, eq(events.email.id, email.id))
      await event(ctx, email.id, 'throttled', { ...error, attempt: attemptNo })
      const delay = Math.min(900, 15 * 2 ** Math.min(attemptNo - 1, 6))
      return { action: 'retry', delaySeconds: delay, result: 'throttled' }
    }

    case 'uncertain':
      await markUncertain(ctx, email, liveIds, error)
      return { action: 'ack', result: 'uncertain' }
  }
}

async function markUncertain(
  ctx: Ctx,
  email: Email,
  recipientIds: string[],
  error?: { code: string; message: string },
) {
  const ev = ctx.db.events
  await ev.db.batch([
    ev.update(
      events.emailRecipient,
      { deliveryStatus: 'submission_uncertain', statusAt: ctx.now },
      and(
        inArray(events.emailRecipient.id, recipientIds),
        eq(events.emailRecipient.deliveryStatus, 'pending'),
      ),
    ),
    ev.update(events.email, { status: 'sent' }, eq(events.email.id, email.id)),
    ev.delete(events.outbox, eq(events.outbox.emailId, email.id)),
  ])
  // Reconciled when SES events carrying dak_email_id arrive (Dak 13/22).
  await event(ctx, email.id, 'submission_uncertain', { ...error })
  await hook(ctx, email, 'email.submission_uncertain', {})
}

/**
 * A message for an email already marked `sending`: a previous worker claimed it and stopped.
 * If it recorded an attempt, the handoff may have happened, so never resend.
 */
async function recoverInFlight(ctx: Ctx, email: Email): Promise<DispatchOutcome> {
  const ev = ctx.db.events
  const [last] = await ev.findMany(events.sendAttempt, eq(events.sendAttempt.emailId, email.id), {
    orderBy: desc(events.sendAttempt.attempt),
    limit: 1,
  })
  if (last && last.outcome === 'uncertain') {
    const pending = await ev.findMany(
      events.emailRecipient,
      and(
        eq(events.emailRecipient.emailId, email.id),
        eq(events.emailRecipient.deliveryStatus, 'pending'),
      ),
    )
    await markUncertain(
      ctx,
      email,
      pending.map((r) => r.id),
      { code: 'WorkerInterrupted', message: 'Worker stopped during submission.' },
    )
    return { action: 'ack', result: 'recovered_uncertain' }
  }
  // Claimed but never attempted (or last attempt was throttled): safe to try again.
  await ev.update(
    events.email,
    { status: 'queued' },
    and(eq(events.email.id, email.id), eq(events.email.status, 'sending')),
  )
  return dispatchEmail(
    ctx.env,
    { emailId: email.id, organizationId: email.organizationId, stream: email.stream },
    ctx.now,
  )
}
