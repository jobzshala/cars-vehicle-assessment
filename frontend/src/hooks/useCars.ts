import { useQuery } from "@apollo/client";
import { GET_CARS } from "../graphql/queries";
import type { Car } from "../types";

interface GetCarsData {
  cars: Car[];
}

export function useCars() {
  const { data, loading, error, refetch } = useQuery<GetCarsData>(GET_CARS);

  return {
    cars: data?.cars ?? [],
    loading,
    error,
    refetch,
  };
}
