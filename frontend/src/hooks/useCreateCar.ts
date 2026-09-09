import { useMutation } from "@apollo/client";
import { CREATE_CAR } from "../graphql/queries";
import type { Car, NewCarInput } from "../types";

interface CreateCarData {
  createCar: Car;
}

interface CreateCarVariables {
  input: NewCarInput;
}

export function useCreateCar() {
  const [mutate, { loading, error }] = useMutation<CreateCarData, CreateCarVariables>(
    CREATE_CAR,
  );

  const createCar = async (input: NewCarInput): Promise<Car> => {
    const { data } = await mutate({ variables: { input } });
    if (!data) throw new Error("CreateCar returned no data");
    return data.createCar;
  };

  return { createCar, loading, error };
}
