
import { httpAxios } from "@/Helper/httpHelper";

export async function GetAllSubjects(domain_id) {
    console.log(domain_id);
    try {
        const response = await httpAxios
            .get(`/domains/${domain_id}/subjects`)
        return response
    } catch (error) {
        throw error;
    }
}