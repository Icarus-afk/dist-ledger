import { useEffect } from 'react';
import Card from '../common/Card';
import RegisterForm from './RegisterForm';
import ProductLookup from './ProductLookup';

const ProductRegistry = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        Product Registry 
        <span className="ml-2 inline-block px-2 py-1 text-xs font-bold rounded bg-main text-white">
          Main Chain
        </span>
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <Card title="Register New Product">
            <RegisterForm />
          </Card>
        </div>
        
        <div className="lg:col-span-7">
          <Card title="Product Lookup">
            <ProductLookup />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProductRegistry;
