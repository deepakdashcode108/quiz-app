import { httpAxios } from "@/Helper/httpHelper";

export async function CreateTag(name: string) {
    try {
        const response = await httpAxios.post(`/tags/`, {
            name: name
        });

        return response;
    } catch (error) {
        throw error;
    }
}

export async function GetAllTags() {
    try {
        const response = await httpAxios.get(`/tags/getall`);

        return response;
    } catch (error) {
        throw error;
    }
}

export async function AttachTagsToQuestion(questionId: number, tagNames: string[]) {
    try {
        const response = await httpAxios.post(`/questions/${questionId}/tags`, {
            tag_names: tagNames
        });

        return response;
    } catch (error) {
        throw error;
    }
}