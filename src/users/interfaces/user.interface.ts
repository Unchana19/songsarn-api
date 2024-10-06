export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  img?: string;
}

export interface UserAuth {
  id: string;
  email: string;
  password: string;
  role: string;
  img?: string;
}
