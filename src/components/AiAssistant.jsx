import React from "react";

const AiAssistant = ({ status, conflictingBookings, isLoading, suggestions, isSuggesting, onSuggestionClick }) => {
  if (status === "idle") {
    return null; // Don't render anything if idle
  }

  let content;
  let baseClasses = "mt-6 p-4 rounded-lg transition-all duration-300 border";
  let statusClasses = "";

  if (isLoading) {
    statusClasses = "bg-yellow-100 border-yellow-400 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-500/50 dark:text-yellow-200";
    content = <p className="font-semibold">AI 正在檢查時段衝突...</p>;
  } else if (status === "conflict") {
    statusClasses = "bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/50 dark:border-orange-500/50 dark:text-orange-200";
    content = (
      <div>
        <h3 className="font-bold text-lg mb-2">時段衝突</h3>
        <p className="mb-3">您選擇的時段已被預約。以下是衝突詳情：</p>
        <ul className="list-disc list-inside space-y-1 mb-4 text-sm">
          {conflictingBookings.map((b) => (
            <li key={b.id}>{b.booking_date}: {b.start_time} - {b.end_time} ({b.purpose})</li>
          ))}
        </ul>
        {isSuggesting && (
          <p className="font-semibold mt-4">AI 正在為您尋找替代時段...</p>
        )}
        {suggestions && suggestions.length > 0 && (
          <div className="mt-4">
            <h4 className="font-bold mb-2">AI 建議替代時段：</h4>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick(s.startTime, s.endTime)}
                  className="px-3 py-1.5 text-sm bg-green-200 text-green-800 rounded-full hover:bg-green-300 dark:bg-green-500/40 dark:text-green-100 dark:hover:bg-green-500/60 transition-colors"
                >
                  {s.startTime} - {s.endTime}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  } else if (status === "available") {
    statusClasses = "bg-green-100 border-green-400 text-green-700 dark:bg-green-900/50 dark:border-green-500/50 dark:text-green-200";
    content = (
      <div className="flex items-center">
        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
        <span className="font-bold">時段可供預約</span>
      </div>
    );
  } else {
     return null; // Should not happen with the initial check, but as a fallback
  }

  return (
    <div className={`${baseClasses} ${statusClasses}`}>
      {content}
    </div>
  );
};

export { AiAssistant };
