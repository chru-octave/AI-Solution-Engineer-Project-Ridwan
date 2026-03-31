import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const SUBMISSION_INCLUDE = {
  insured: true,
  broker: true,
  linesOfBusiness: true,
  limits: true,
  targetPricing: true,
  exposures: true,
  losses: true,
} as const;

router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, lineOfBusiness, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { emailSubject: { contains: search as string, mode: "insensitive" } },
        {
          insured: {
            companyName: { contains: search as string, mode: "insensitive" },
          },
        },
        {
          broker: {
            companyName: { contains: search as string, mode: "insensitive" },
          },
        },
      ];
    }

    if (lineOfBusiness) {
      where.linesOfBusiness = {
        some: {
          type: { contains: lineOfBusiness as string, mode: "insensitive" },
        },
      };
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: SUBMISSION_INCLUDE,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.submission.count({ where }),
    ]);

    res.json({
      data: submissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Error fetching submissions:", err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: SUBMISSION_INCLUDE,
    });

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json({ data: submission });
  } catch (err) {
    console.error("Error fetching submission:", err);
    res.status(500).json({ error: "Failed to fetch submission" });
  }
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.submission.delete({ where: { id: req.params.id } });
    res.json({ message: "Submission deleted" });
  } catch (err) {
    console.error("Error deleting submission:", err);
    res.status(500).json({ error: "Failed to delete submission" });
  }
});

export default router;
