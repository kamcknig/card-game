import { AwilixContainer, InjectionMode, createContainer } from 'awilix';

// Creates an Awilix container configured for constructor-argument injection in tests.
export const createTestContainer = <T extends object>(): AwilixContainer<T> => {
  return createContainer<T>({
    injectionMode: InjectionMode.CLASSIC,
  });
};
