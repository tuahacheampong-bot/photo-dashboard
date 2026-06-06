interface MiniStatProps {
  title: string;
  value: number | string;
}

export function MiniStat({ title, value }: MiniStatProps) {
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
      <p className="text-sm font-bold text-gray-600 uppercase">{title}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}