import { httpAxios } from "@/Helper/httpHelper";

export async function AddDomain(data) {
    try {
        const response = await httpAxios.post("/domains/add", data);
        return response;
    } catch (error) {
        throw error;
    }
}
