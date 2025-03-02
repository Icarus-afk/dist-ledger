const StatusIndicator = ({ status }) => {
  const classes = status === 'online' || status === true 
    ? 'bg-green-500' 
    : 'bg-red-500';
  
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${classes}`}></span>;
};

export default StatusIndicator;
