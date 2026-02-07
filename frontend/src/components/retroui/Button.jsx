import { cn } from "../../lib/utils";
import { cva } from "class-variance-authority";
import React from "react";
import { Slot } from "@radix-ui/react-slot";

const buttonVariants = cva(
  "font-head transition-all outline-hidden cursor-pointer duration-200 font-medium flex items-center",
  {
    variants: {
      variant: {
        default:
          "shadow-md hover:shadow-none bg-primary text-primary-foreground border-2 border-black transition hover:translate-y-1 hover:bg-primary-hover",
        primary:
          "shadow-md hover:shadow-none bg-primary text-primary-foreground border-2 border-black transition hover:translate-y-1 hover:bg-primary-hover",
        secondary:
          "shadow-md hover:shadow-none bg-secondary shadow-primary text-secondary-foreground border-2 border-black transition hover:translate-y-1",
        outline:
          "shadow-md hover:shadow-none bg-transparent border-2 transition hover:translate-y-1",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "bg-transparent hover:underline",
      },
      size: {
        sm: "px-3 py-1 text-sm shadow hover:shadow-none",
        md: "px-4 py-1.5 text-base",
        lg: "px-8 py-3 text-lg",
        icon: "p-2",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export const Button = React.forwardRef((
  {
    children,
    size = "md",
    className = "",
    variant = "default",
    asChild = false,
    ...props
  },
  forwardedRef,
) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={forwardedRef}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}>
      {children}
    </Comp>
  );
});

Button.displayName = "Button";
