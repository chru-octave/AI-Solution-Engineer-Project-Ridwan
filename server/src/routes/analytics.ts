import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const [
      totalSubmissions,
      linesOfBusiness,
      brokers,
    ] = await Promise.all([
      prisma.submission.count(),
      prisma.lineOfBusiness.groupBy({
        by: ["type"],
        _count: { type: true },
        orderBy: { _count: { type: "desc" } },
      }),
      prisma.brokerInfo.findMany({
        select: { companyName: true },
        where: { companyName: { not: null } },
        distinct: ["companyName"],
      }),
    ]);

    res.json({
      data: {
        totalSubmissions,
        linesOfBusiness: linesOfBusiness.map((l) => ({
          type: l.type,
          count: l._count.type,
        })),
        brokers: brokers.map((b) => ({
          companyName: b.companyName,
        })),
      },
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.get("/losses", async (_req: Request, res: Response) => {
  try {
    const losses = await prisma.lossRecord.findMany({
      include: {
        submission: {
          select: { emailSubject: true, insured: { select: { companyName: true } } },
        },
      },
      orderBy: { policyYear: "desc" },
    });

    res.json({ data: losses });
  } catch (err) {
    console.error("Error fetching loss data:", err);
    res.status(500).json({ error: "Failed to fetch loss data" });
  }
});

router.get("/exposures", async (_req: Request, res: Response) => {
  try {
    const exposures = await prisma.exposureInfo.findMany({
      include: {
        submission: {
          select: { emailSubject: true, insured: { select: { companyName: true } } },
        },
      },
    });

    res.json({ data: exposures });
  } catch (err) {
    console.error("Error fetching exposure data:", err);
    res.status(500).json({ error: "Failed to fetch exposure data" });
  }
});

export default router;
