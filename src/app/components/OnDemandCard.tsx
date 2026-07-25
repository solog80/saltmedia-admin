import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface OnDemandCardProps {
  image: string;
  title: string;
  description: string;
  link: string;
}

const OnDemandCard: React.FC<OnDemandCardProps> = ({ image, title, description, link }) => {
  return (
    <div className="frosted-glass overflow-hidden flex flex-col h-full group">
      <Link href={link} className="block relative aspect-video overflow-hidden">
        <img
          src={image}
          alt={title}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
      </Link>
      <div className="p-4 pb-2">
        <h3 className="text-lg line-clamp-1 text-white font-semibold">{title}</h3>
      </div>
      <div className="p-4 pt-0 flex-grow">
        <p className="text-sm text-white/70 line-clamp-2">
          {description}
        </p>
      </div>
      <div className="p-4 pt-0">
        <Link href={link} className="block">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Watch Now
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default OnDemandCard;