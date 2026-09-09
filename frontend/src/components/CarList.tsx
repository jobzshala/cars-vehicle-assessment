import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { CarCard } from "./CarCard";
import type { Car } from "../types";

interface CarListProps {
  cars: Car[];
  loading?: boolean;
  error?: Error;
}

export function CarList({ cars, loading = false, error }: CarListProps) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress aria-label="Loading cars" />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load cars: {error.message}</Alert>;
  }

  if (cars.length === 0) {
    return (
      <Typography color="text.secondary" align="center" py={6}>
        No cars found.
      </Typography>
    );
  }

  return (
    <Grid container spacing={3}>
      {cars.map((car) => (
        <Grid key={car.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <CarCard car={car} />
        </Grid>
      ))}
    </Grid>
  );
}
