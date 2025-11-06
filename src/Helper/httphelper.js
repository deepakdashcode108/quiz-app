import axios from "axios";
console.log(123);
export const httpAxios = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BASE_URL
    
})