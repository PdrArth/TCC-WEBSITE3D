export type UpdateKind = "announcement" | "research" | "company_case";
export type PublicUpdate = { id: string; title: string; summary: string; relevance: string; limitations: string; sourceUrl: string; organization: string; type: UpdateKind; eventDate: string | null; publicationDate: string; checkedDate: string; publishedAt: string | null; };
export type UpdateRow = PublicUpdate & { status: "draft" | "published" | "discarded"; createdAt: string; revision: number; };
export type ResearchRun = { id: string; checkedAt: string; status: "success" | "partial" | "failed"; summary: string; };
