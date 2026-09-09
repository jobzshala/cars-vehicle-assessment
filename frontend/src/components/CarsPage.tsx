import { useState } from "react";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { useCars } from "../hooks/useCars";
import { useCreateCar } from "../hooks/useCreateCar";
import { useCarFilters } from "../hooks/useCarFilters";
import { CarList } from "./CarList";
import { CarFilters } from "./CarFilters";
import { AddCarForm } from "./AddCarForm";
import type { Car, NewCarInput } from "../types";

export function CarsPage() {
  const { cars: fetchedCars, loading, error } = useCars();
  const { createCar, loading: creating, error: createError } = useCreateCar();
  const [addedCars, setAddedCars] = useState<Car[]>([]);

  const allCars = [...addedCars, ...fetchedCars];
  const filters = useCarFilters(allCars);

  const handleAddCar = async (input: NewCarInput) => {
    const created = await createCar(input);
    setAddedCars((prev) => [created, ...prev]);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Cars
      </Typography>

      <AddCarForm onSubmit={handleAddCar} submitting={creating} error={createError?.message} />

      <CarFilters
        search={filters.search}
        onSearchChange={filters.setSearch}
        sort={filters.sort}
        onSortChange={filters.setSort}
        year={filters.year}
        onYearChange={filters.setYear}
        availableYears={filters.availableYears}
      />

      <CarList cars={filters.filteredCars} loading={loading} error={error} />
    </Container>
  );
}
