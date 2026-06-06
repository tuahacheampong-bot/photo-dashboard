interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
}

export function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className={`${color} rounded-2xl p-5 border-2 border-gray-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-700 uppercase">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}