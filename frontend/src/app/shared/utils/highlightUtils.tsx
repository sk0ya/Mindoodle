import React from 'react';


export const highlightSearchTerm = (text: string, searchTerm: string): React.ReactElement => {
  if (!searchTerm.trim()) {
    return <>{text}</>;
  }

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = new RegExp(`^${escaped}$`, 'i').test(part);
        return isMatch ? (
          <mark key={index} className="search-highlight">{part}</mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        );
      })}
    </>
  );
};
