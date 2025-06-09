import { ChevronRightIcon } from "@heroicons/react/24/outline";

const ServiceCard = ({ category, title, description, image }) => {
  return (
    <div className='bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden'>
      <div
        className='w-full h-36 bg-gray-100'
        style={{
          backgroundImage: `url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      ></div>
      <div className='p-4 flex flex-col gap-2'>
        <h3 className='text-sm font-semibold text-gray-900 line-clamp-1'>
          {title}
        </h3>
        <p className='text-sm text-gray-600 line-clamp-2'>{description}</p>
        <div className='flex justify-between items-center pt-2'>
          <span className='text-xs text-blue-600 font-medium'>{category}</span>
          <ChevronRightIcon className='w-5 h-5 text-gray-400' />
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
