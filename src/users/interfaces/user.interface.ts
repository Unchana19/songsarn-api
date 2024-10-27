export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone_number?: string;
  img?: string;
  address?: string;
  province?: string;
  zip_code?: string;
}

export interface UserAuth {
  id: string;
  email: string;
  password: string;
  role: string;
  img?: string;
}
