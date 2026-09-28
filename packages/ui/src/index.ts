/** Public component exports. Import `@khata-club/ui/styles.css` once. */

export { cn } from "./lib/utils";
export {
  formatAmount,
  minorUnits,
  type FormatAmountOptions,
  type FormattedAmount,
} from "./lib/currency";

/* Primitives */
export { Label, type LabelProps } from "./components/Label";
export { Separator, type SeparatorProps } from "./components/Separator";
export { Skeleton, type SkeletonProps } from "./components/Skeleton";
export { Spinner, type SpinnerProps } from "./components/Spinner";
export {
  VisuallyHidden,
  type VisuallyHiddenProps,
} from "./components/VisuallyHidden";
export {
  Avatar,
  AvatarFallback,
  AvatarImage,
  type AvatarProps,
} from "./components/Avatar";

/* Content */
export { Badge, BadgeButton } from "./components/Badge";
export type { BadgeButtonProps, BadgeProps } from "./components/Badge";
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/Card";
export type { CardProps, CardTitleProps } from "./components/Card";
export { Logo, type LogoProps } from "./components/Logo";
export { Typography, type TypographyProps } from "./components/Typography";

/* Actions */
export { Button, type ButtonProps } from "./components/Button";

/* Forms */
export {
  FormField,
  useFormField,
  type FormFieldProps,
} from "./components/FormField";
export { Input, type InputProps } from "./components/Input";
export { Checkbox, type CheckboxProps } from "./components/Checkbox";
export { Switch, type SwitchProps } from "./components/Switch";
export {
  RadioGroup,
  RadioGroupItem,
  type RadioGroupItemProps,
  type RadioGroupProps,
} from "./components/RadioGroup";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/Select";
export type {
  SelectContentProps,
  SelectItemProps,
  SelectTriggerProps,
} from "./components/Select";

/* Overlays */
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
} from "./components/Dialog";
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type TooltipContentProps,
} from "./components/Tooltip";
export {
  Toast,
  ToastAction,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from "./components/Toast";

/* Navigation */
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/Tabs";

/* Data */
export {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/Table";
export type {
  TableCellProps,
  TableHeadProps,
  TableProps,
} from "./components/Table";
export { Amount, type AmountProps } from "./components/Amount";
