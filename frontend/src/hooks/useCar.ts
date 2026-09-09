import { useQuery } from "@apollo/client";
import { GET_CAR } from "../graphql/queries";
import type { Car } from "../types";

export interface CarLookup {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}

interface GetCarData {
  car: Car | null;
}

export function useCar(lookup: CarLookup) {
  const hasCriteria = Object.values(lookup).some((value) => value !== undefined);

  const { data, loading, error } = useQuery<GetCarData, CarLookup>(GET_CAR, {
    variables: lookup,
    skip: !hasCriteria,
  });

  return {
    car: data?.car ?? null,
    loading,
    error,
  };
}
