import { httpAxios } from "@/Helper/httpHelper";
export async function GetAllDomain() {
    try {
        const response = await httpAxios
            .get("/domains")
        return response
    } catch (error) {
        throw error;
    }
}