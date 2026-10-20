import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography, touchTargets } from '@fieldlog/ui-tokens';
import {
  createInspection,
  updateInspection,
  createObservation,
  getInspection,
  getObservationsForInspection,
} from '../repositories/inspections';

interface InspectionFormScreenProps {
  inspectionId?: string;
  onBack: () => void;
  onSave: () => void;
}

export function InspectionFormScreen({
  inspectionId,
  onBack,
  onSave,
}: InspectionFormScreenProps) {
  const [isLoading, setIsLoading] = useState(!!inspectionId);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [overallScore, setOverallScore] = useState('');
  const [observationCode, setObservationCode] = useState('');
  const [observationNote, setObservationNote] = useState('');
  const [observations, setObservations] = useState<any[]>([]);

  useEffect(() => {
    if (inspectionId) {
      loadInspection();
    }
  }, [inspectionId]);

  const loadInspection = async () => {
    if (!inspectionId) return;

    try {
      const inspection = await getInspection(inspectionId);
      if (inspection) {
        setNotes(inspection.notes || '');
        setOverallScore(inspection.overallScore?.toString() || '');
      }

      const obs = await getObservationsForInspection(inspectionId);
      setObservations(obs);
    } catch (error) {
      console.error('Failed to load inspection:', error);
      Alert.alert('Error', 'Failed to load inspection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (inspectionId) {
        await updateInspection({
          id: inspectionId,
          notes: notes || undefined,
          overallScore: overallScore ? parseInt(overallScore, 10) : undefined,
        });
      } else {
        const result = await createInspection({
          blockId: '00000000-0000-0000-0000-000000000031',
          inspectorId: '00000000-0000-0000-0000-000000000013',
          orgId: '00000000-0000-0000-0000-000000000001',
        });

        if (notes || overallScore) {
          await updateInspection({
            id: result.id,
            notes: notes || undefined,
            overallScore: overallScore ? parseInt(overallScore, 10) : undefined,
          });
        }
      }

      onSave();
    } catch (error) {
      console.error('Failed to save inspection:', error);
      Alert.alert('Error', 'Failed to save inspection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddObservation = async () => {
    if (!inspectionId || !observationCode.trim()) {
      Alert.alert('Error', 'Please fill in the observation code');
      return;
    }

    try {
      await createObservation({
        inspectionId,
        kind: 'PEST',
        code: observationCode.trim(),
        note: observationNote.trim() || undefined,
      });

      setObservationCode('');
      setObservationNote('');
      
      const obs = await getObservationsForInspection(inspectionId);
      setObservations(obs);

      Alert.alert('Success', 'Observation added');
    } catch (error) {
      console.error('Failed to add observation:', error);
      Alert.alert('Error', 'Failed to add observation');
    }
  };

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
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {inspectionId ? 'Edit Inspection' : 'New Inspection'}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this inspection..."
            placeholderTextColor={colors.neutral[400]}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Overall Score (0-100)</Text>
          <TextInput
            style={styles.input}
            value={overallScore}
            onChangeText={setOverallScore}
            placeholder="50"
            placeholderTextColor={colors.neutral[400]}
            keyboardType="numeric"
          />
        </View>

        {inspectionId && (
          <>
            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Observations ({observations.length})</Text>
              
      {observations.map((obs: any) => (
        <View key={obs.id} style={styles.observationCard}>
                  <Text style={styles.observationKind}>{obs.kind}</Text>
                  <Text style={styles.observationCode}>Code: {obs.code}</Text>
                  {obs.note && (
                    <Text style={styles.observationNote}>{obs.note}</Text>
                  )}
                </View>
              ))}

              <View style={styles.addObservationForm}>
                <Text style={styles.label}>Add Observation</Text>
                <TextInput
                  style={styles.input}
                  value={observationCode}
                  onChangeText={setObservationCode}
                  placeholder="Observation code (e.g., PEST-001)"
                  placeholderTextColor={colors.neutral[400]}
                />
                <TextInput
                  style={styles.textArea}
                  value={observationNote}
                  onChangeText={setObservationNote}
                  placeholder="Observation notes..."
                  placeholderTextColor={colors.neutral[400]}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleAddObservation}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>Add Observation</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.neutral[0]} />
          ) : (
            <Text style={styles.saveButtonText}>
              {inspectionId ? 'Save Changes' : 'Create Inspection'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.primary[600],
    padding: spacing.lg,
    gap: spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
  },
  input: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.md,
    color: colors.neutral[900],
    minHeight: touchTargets.comfortable,
  },
  textArea: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.md,
    color: colors.neutral[900],
    minHeight: 100,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.md,
  },
  observationCard: {
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  observationKind: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  observationCode: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[900],
  },
  observationNote: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  addObservationForm: {
    backgroundColor: colors.neutral[100],
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  saveButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: touchTargets.primary,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.primary[400],
  },
  saveButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});
