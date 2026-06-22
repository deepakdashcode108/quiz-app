import { httpAxios } from "@/Helper/httpHelper";

export async function AddSubject(domain_id, data) {
    try {
        const response = await httpAxios.post(`/domains/${domain_id}/subjects/add`, data);
        return response;
    } catch (error) {
        throw error;
    }
}
