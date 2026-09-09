import { gql } from "@apollo/client";

export const CAR_FIELDS = gql`
  fragment CarFields on Car {
    id
    make
    model
    year
    color
    mobile
    tablet
    desktop
  }
`;

export const GET_CARS = gql`
  ${CAR_FIELDS}
  query GetCars {
    cars {
      ...CarFields
    }
  }
`;

export const GET_CAR = gql`
  ${CAR_FIELDS}
  query GetCar($make: String, $model: String, $year: Int, $color: String) {
    car(make: $make, model: $model, year: $year, color: $color) {
      ...CarFields
    }
  }
`;

export const CREATE_CAR = gql`
  ${CAR_FIELDS}
  mutation CreateCar($input: NewCarInput!) {
    createCar(input: $input) {
      ...CarFields
    }
  }
`;
