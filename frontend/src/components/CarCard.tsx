import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useDeviceType } from "../hooks/useDeviceType";
import type { Car } from "../types";

interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const deviceType = useDeviceType();
  const imageUrl = car[deviceType];

  return (
    <Card
      data-testid="car-card"
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <CardMedia
        component="img"
        image={imageUrl}
        alt={`${car.make} ${car.model}`}
        sx={{ aspectRatio: "16 / 9", objectFit: "cover" }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="h3" gutterBottom>
          {car.make} {car.model}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={car.year} size="small" />
          <Chip label={car.color} size="small" variant="outlined" />
        </Stack>
      </CardContent>
    </Card>
  );
}
