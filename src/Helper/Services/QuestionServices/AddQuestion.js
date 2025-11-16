import { httpAxios } from "@/Helper/httpHelper";

export async function AddQuestion(domain_id , data) {
    console.log(data , domain_id);
    try {
        const response = await httpAxios
            .post(`domains/${domain_id}/questions/add`, data);
        return response
    } catch (error) {
        throw error;
    }
}