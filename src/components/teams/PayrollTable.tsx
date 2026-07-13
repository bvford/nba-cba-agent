export interface PayrollRow {
  name: string;
  position: string;
  salary: string | null;
}

interface PayrollTableProps {
  teamName: string;
  season: string;
  players: PayrollRow[];
}

export function PayrollTable({ teamName, season, players }: PayrollTableProps) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-xl border border-(--color-border)">
      <table className="w-full min-w-[420px] border-collapse text-left text-sm">
        <caption className="sr-only">{`${teamName} ${season} player payroll, sorted by salary, highest first`}</caption>
        <thead className="sticky top-0 z-10 bg-(--color-surface-raised) text-(--color-text-primary) shadow-[0_1px_0_var(--color-border)]">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Player
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Pos
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">
              {season} Salary
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            // players.json occasionally has literal duplicate rows for the
            // same name, so the index has to be part of the key.
            <tr
              key={`${player.name}-${index}`}
              className="border-t border-(--color-border) hover:bg-(--color-surface-hover)/50 transition-colors"
            >
              <td className="px-4 py-2.5 text-(--color-text-primary)">{player.name}</td>
              <td className="px-4 py-2.5 text-(--color-text-secondary)">{player.position || "—"}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-(--color-text-secondary)">
                {player.salary ?? "Unsigned"}
              </td>
            </tr>
          ))}
          {players.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-(--color-text-muted)">
                No roster data available for this team.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
