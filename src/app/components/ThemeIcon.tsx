"use client";
import { useTheme } from "./ThemeProvider";
import { HugeiconsIcon } from '@hugeicons/react';
import Sun01Icon from '@hugeicons/core-free-icons/dist/esm/Sun01Icon';
import Moon01Icon from '@hugeicons/core-free-icons/dist/esm/Moon01Icon';
import { Button } from "@/components/ui/button";

export const ThemeIcon = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="rounded-full"
    >
      {theme === "light" ? (
        <HugeiconsIcon icon={Sun01Icon} size={20} />
      ) : (
        <HugeiconsIcon icon={Moon01Icon} size={20} />
      )}
    </Button>
  );
};
