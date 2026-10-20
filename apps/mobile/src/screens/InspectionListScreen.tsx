import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography, touchTargets } from '@fieldlog/ui-tokens';
import { getInspections } from '../repositories/inspections';
import { sync, getSyncStatus, type SyncStatus } from '../sync/client';

interface Inspection {
  id: string;
  blockId: string;
  status: string;
  syncState: string;
  notes: string | null;
  createdAt: Date;
}

interface InspectionListScreenProps {
  onCreateNew: () => void;
  onEditInspection: (id: string) => void;
}

export function InspectionListScreen({
  onCreateNew,
  onEditInspection,
}: InspectionListScreenProps) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  const loadInspections = async () => {
    try {
      const data = await getInspections();
      setInspections(data as Inspection[]);
    } catch (error) {
      console.error('Failed to load inspections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
    const interval = setInterval(() => {
      setSyncStatus(getSyncStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const API_URL = 'http://localhost:3001';
      const DEVICE_ID = 'dev-device-001';
      await sync(API_URL, DEVICE_ID);
      await loadInspections();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderSyncStatus = () => {
    let statusText = '';
    let statusColor = colors.neutral[500];

    switch (syncStatus.state) {
      case 'idle':
        statusText = 'Ready';
        statusColor = colors.neutral[500];
        break;
      case 'syncing':
        statusText = `Syncing ${syncStatus.progress.current}/${syncStatus.progress.total}...`;
        statusColor = colors.status.syncing;
        break;
      case 'success':
        const mins = Math.floor((Date.now() - syncStatus.syncedAt) / 60000);
        statusText = `Up to date · ${mins === 0 ? 'now' : `${mins}m ago`}`;
        statusColor = colors.status.synced;
        break;
      case 'error':
        statusText = `Error: ${syncStatus.error}`;
        statusColor = colors.status.error;
        break;
      case 'offline':
        statusText = 'Offline';
        statusColor = colors.status.offline;
        break;
    }

    return (
      <View style={[styles.syncStatus, { backgroundColor: `${statusColor}15` }]}>
        {syncStatus.state === 'syncing' && (
          <ActivityIndicator size="small" color={statusColor} />
        )}
        <Text style={[styles.syncStatusText, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>
    );
  };

  const renderSyncBadge = (syncState: string) => {
    const badges = {
      local_only: { text: 'Local', color: colors.warning[500] },
      pending: { text: 'Pending', color: colors.warning[600] },
      synced: { text: 'Synced', color: colors.success[500] },
      conflict: { text: 'Conflict', color: colors.danger[500] },
      rejected: { text: 'Rejected', color: colors.danger[600] },
    };

    const badge = badges[syncState as keyof typeof badges] || badges.local_only;

    return (
      <View style={[styles.badge, { backgroundColor: `${badge.color}15` }]}>
        <Text style={[styles.badgeText, { color: badge.color }]}>
          {badge.text}
        </Text>
      </View>
    );
  };

  const renderInspection = ({ item }: { item: Inspection }) => (
    <TouchableOpacity
      style={styles.inspectionCard}
      onPress={() => onEditInspection(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.inspectionHeader}>
        <Text style={styles.inspectionTitle}>
          Block: {item.blockId.slice(0, 8)}...
        </Text>
        {renderSyncBadge(item.syncState)}
      </View>
      <Text style={styles.inspectionStatus}>
        Status: {item.status}
      </Text>
      {item.notes && (
        <Text style={styles.inspectionNotes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
      <Text style={styles.inspectionDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inspections</Text>
        {renderSyncStatus()}
      </View>

      <FlatList
        data={inspections}
        renderItem={renderInspection}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[600]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No inspections yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to create one
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={onCreateNew}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    backgroundColor: colors.primary[600],
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  syncStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  inspectionCard: {
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
    shadowColor: colors.neutral[1000],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inspectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  inspectionStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  inspectionNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
  },
  inspectionDate: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[600],
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: touchTargets.primary,
    height: touchTargets.primary,
    borderRadius: touchTargets.primary / 2,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.neutral[1000],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: typography.fontSize.xxxl,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize.xxxl,
  },
});
