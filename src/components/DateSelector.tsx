import { Icon } from './Icon';

interface DateSelectorProps {
  availableDates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export const DateSelector = ({ availableDates, selectedDate, onDateChange }: DateSelectorProps) => {
  const currentIndex = availableDates.indexOf(selectedDate);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      onDateChange(availableDates[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (currentIndex < availableDates.length - 1) {
      onDateChange(availableDates[currentIndex + 1]);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="date-selector">
      <button 
        onClick={goToPrevious} 
        disabled={currentIndex === 0}
        className="nav-btn"
      >
        <Icon name="chevron-left" size={16} />
        <span>Previous</span>
      </button>
      
      <div className="date-display">
        <Icon name="calendar" size={18} />
        <select 
          value={selectedDate} 
          onChange={(e) => onDateChange(e.target.value)}
          className="date-dropdown"
        >
          {availableDates.map(date => (
            <option key={date} value={date}>
              {formatDate(date)}
            </option>
          ))}
        </select>
      </div>

      <button 
        onClick={goToNext} 
        disabled={currentIndex === availableDates.length - 1}
        className="nav-btn"
      >
        <span>Next</span>
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
};
