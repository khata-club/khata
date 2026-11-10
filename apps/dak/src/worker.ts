/** Only `run_worker_first` paths reach this handler; everything else is served from assets. */
export default {
  fetch(request, env) {
    return env.API.fetch(request)
  },
} satisfies ExportedHandler<Env>
