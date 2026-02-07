import { cn } from "../../lib/utils";
import { cva } from "class-variance-authority";

const cardVariants = cva(
  "rounded-md border bg-card",
  {
    variants: {
      variant: {
        default: "",
        neobrutal: "border-primary shadow-glow rounded-2xl"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

const Card = ({
  className,
  variant,
  ...props
}) => {
  return (
    <div
      className={cn(cardVariants({ variant }), className)}
      {...props} />
  );
};

const CardHeader = ({
  className,
  ...props
}) => {
  return (<div className={cn("flex flex-col justify-start p-4", className)} {...props} />);
};

const CardTitle = ({
  className,
  ...props
}) => {
  return <h3 className={cn("mb-2 font-semibold", className)} {...props} />;
};

const CardDescription = ({
  className,
  ...props
}) => (
  <p className={cn("text-muted-foreground", className)} {...props} />
);

const CardContent = ({
  className,
  ...props
}) => {
  return <div className={cn("p-4", className)} {...props} />;
};

const CardComponent = Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
});

export { CardComponent as Card };
