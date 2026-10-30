import {
  type HealthResponse,
  SERVICE_UNAVAILABLE,
} from "@closeout/contracts/schemas";
import { Controller, Get, HttpStatus, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { AppException } from "@/problem/app-exception";

const PING_TIMEOUT_MS = 3_000;

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Up only when Postgres answers within the ping timeout. A failure names
   * only its outcome: driver errors carry the host and port.
   */
  @Get("health")
  async health(): Promise<HealthResponse> {
    const outcome = await this.pingDatabase();
    if (outcome !== "up") {
      this.logger.warn({ outcome }, "Database health check failed");
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        SERVICE_UNAVAILABLE,
        { checks: { database: "down" } },
      );
    }
    return { status: "ok", checks: { database: "up" } };
  }

  private async pingDatabase(): Promise<"up" | "failed" | "timeout"> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), PING_TIMEOUT_MS);
    });
    const ping = this.dataSource.query("SELECT 1").then(
      () => "up" as const,
      () => "failed" as const,
    );
    try {
      return await Promise.race([ping, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
