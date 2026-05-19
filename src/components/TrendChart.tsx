import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TrendAnalytics } from '../types';

interface TrendChartProps {
  data: TrendAnalytics | null;
}

export const TrendChart = ({ data }: TrendChartProps) => {
  if (!data) {
    return (
      <div className="chart-placeholder">
        <p>Ask Kiro AI for trend analysis</p>
      </div>
    );
  }

  const chartData = data.trend_data.map(item => ({
    date: item.date,
    total: item.total_quantity,
    ...item.species_breakdown
  }));

  const species = Object.keys(data.trend_data[0]?.species_breakdown || {});
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

  return (
    <div className="trend-container">
      <h3>Trend Analysis - {data.trend_period}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="total" stroke="#2C3E50" strokeWidth={2} name="Total" />
          {species.map((sp, idx) => (
            <Line key={sp} type="monotone" dataKey={sp} stroke={colors[idx]} name={sp} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="prediction">
        <p><strong>Predicted Next Day:</strong> {data.predicted_next_day} releases</p>
      </div>
    </div>
  );
};
