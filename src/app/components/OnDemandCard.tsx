import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Card, CardActionArea, CardContent, CardMedia, Typography, Button
} from '@mui/material';

interface OnDemandCardProps {
  image: string;
  title: string;
  description: string;
  link: string;
}

const OnDemandCard: React.FC<OnDemandCardProps> = ({ image, title, description, link }) => {
  return (
    <Card sx={{ maxWidth: 345, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea component={Link} href={link} style={{ flexGrow: 1 }}>
        <CardMedia
          component="img"
          height="140"
          image={image}
          alt={title}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent>
          <Typography gutterBottom variant="h5" component="div">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </CardContent>
      </CardActionArea>
      <Button
        component={Link}
        href={link}
        variant="contained"
        color="primary"
        sx={{ margin: 2, alignSelf: 'flex-start' }}
      >
        Watch Now
      </Button>
    </Card>
  );
};

export default OnDemandCard;