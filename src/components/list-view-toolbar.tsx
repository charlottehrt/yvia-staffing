import type { ReactNode } from "react";

type ListViewToolbarProps = {
  children: ReactNode;
  action: ReactNode;
};

export function ListViewToolbar({ children, action }: ListViewToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1">{children}</div>
      <div className="flex justify-end sm:ml-auto">{action}</div>
    </div>
  );
}
