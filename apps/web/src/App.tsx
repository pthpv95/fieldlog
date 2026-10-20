import React from 'react';
import { colors, spacing, typography } from '@fieldlog/ui-tokens';

export function App() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.neutral[50] }}>
      <header
        style={{
          backgroundColor: colors.primary[600],
          color: colors.neutral[0],
          padding: `${spacing.md}px ${spacing.lg}px`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.bold }}>
          FieldLog Supervisor Dashboard
        </h1>
      </header>

      <main style={{ padding: spacing.lg, maxWidth: '1200px', margin: '0 auto' }}>
        <section
          style={{
            backgroundColor: colors.neutral[0],
            borderRadius: '8px',
            padding: spacing.lg,
            marginBottom: spacing.lg,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h2
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.semibold,
              marginBottom: spacing.md,
              color: colors.neutral[900],
            }}
          >
            Welcome to FieldLog
          </h2>
          <p style={{ color: colors.neutral[600], lineHeight: typography.lineHeight.relaxed }}>
            This is the supervisor dashboard for reviewing orchard inspections. The full implementation
            will include:
          </p>
          <ul
            style={{
              marginTop: spacing.md,
              marginLeft: spacing.lg,
              color: colors.neutral[700],
              lineHeight: typography.lineHeight.relaxed,
            }}
          >
            <li>Inspections table with filters and sorting</li>
            <li>MapLibre GL JS map showing inspection locations</li>
            <li>Review and approve functionality</li>
            <li>Conflict log viewer</li>
            <li>Real-time sync status indicators</li>
          </ul>
        </section>

        <section
          style={{
            backgroundColor: colors.neutral[0],
            borderRadius: '8px',
            padding: spacing.lg,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h2
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.semibold,
              marginBottom: spacing.md,
              color: colors.neutral[900],
            }}
          >
            Architecture Status
          </h2>
          <div style={{ display: 'grid', gap: spacing.md }}>
            <StatusCard
              label="Domain Models"
              status="complete"
              description="Zod schemas for inspections, observations, photos"
            />
            <StatusCard
              label="Sync Core"
              status="complete"
              description="HLC implementation and conflict resolution logic"
            />
            <StatusCard
              label="API Endpoints"
              status="complete"
              description="Push/pull sync endpoints with idempotency"
            />
            <StatusCard
              label="Database Schema"
              status="complete"
              description="Prisma schema with change log and conflict tracking"
            />
            <StatusCard
              label="Mobile App"
              status="roadmap"
              description="React Native with SQLite + Drizzle"
            />
            <StatusCard
              label="Maps Integration"
              status="roadmap"
              description="MapLibre with offline tile packs"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

interface StatusCardProps {
  label: string;
  status: 'complete' | 'in-progress' | 'roadmap';
  description: string;
}

function StatusCard({ label, status, description }: StatusCardProps) {
  const statusColors = {
    complete: colors.success[500],
    'in-progress': colors.warning[500],
    roadmap: colors.neutral[400],
  };

  const statusLabels = {
    complete: '✓ Complete',
    'in-progress': '⋯ In Progress',
    roadmap: '○ Roadmap',
  };

  return (
    <div
      style={{
        padding: spacing.md,
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <h3
          style={{
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.medium,
            marginBottom: spacing.xs,
            color: colors.neutral[900],
          }}
        >
          {label}
        </h3>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.neutral[600] }}>
          {description}
        </p>
      </div>
      <div
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          color: statusColors[status],
          padding: `${spacing.xs}px ${spacing.sm}px`,
          backgroundColor: `${statusColors[status]}15`,
          borderRadius: '4px',
          whiteSpace: 'nowrap',
        }}
      >
        {statusLabels[status]}
      </div>
    </div>
  );
}
