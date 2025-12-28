
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };



export const isSuccess = <T, E>(result: Result<T, E>): result is { success: true; data: T } => {
  return result.success;
};

export const isFailure = <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
  return !result.success;
};


export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (_value: T) => U
): Result<U, E> => {
  if (isSuccess(result)) {
    return { success: true, data: fn(result.data) };
  }
  return { success: false, error: result.error };
};

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (_value: T) => Result<U, E>
): Result<U, E> => {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return { success: false, error: result.error };
};


export const match = <T, E, U>(
  result: Result<T, E>,
  patterns: {
    success: (_data: T) => U;
    failure: (_error: E) => U;
  }
): U => {
  if (isSuccess(result)) {
    return patterns.success(result.data);
  }
  return patterns.failure(result.error);
};

