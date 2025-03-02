const Card = ({ title, actions, children }) => {
  return (
    <div className="card">
      <div className="card-header">
        {title}
        {actions && <div>{actions}</div>}
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
};

export default Card;
