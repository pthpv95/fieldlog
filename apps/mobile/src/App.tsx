import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography } from '@fieldlog/ui-tokens';
import { initializeDatabase } from './db';
import { InspectionListScreen } from './screens/InspectionListScreen';
import { InspectionFormScreen } from './screens/InspectionFormScreen';

type Screen = 'list' | 'form' | 'edit';

interface AppState {
  currentScreen: Screen;
  selectedInspectionId?: string;
  isInitialized: boolean;
}

function App(): React.JSX.Element {
  const [state, setState] = useState<AppState>({
    currentScreen: 'list',
    isInitialized: false,
  });

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        setState((s) => ({ ...s, isInitialized: true }));
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
      });
  }, []);

  const navigateToForm = (inspectionId?: string) => {
    setState((s: AppState) => ({
      currentScreen: inspectionId ? 'edit' : 'form',
      selectedInspectionId: inspectionId,
      isInitialized: true,
    }));
  };

  const navigateToList = () => {
    setState({
      currentScreen: 'list',
      selectedInspectionId: undefined,
      isInitialized: true,
    });
  };

  if (!state.isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Initializing database...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary[700]} />
      
      {state.currentScreen === 'list' && (
        <InspectionListScreen
          onCreateNew={() => navigateToForm()}
          onEditInspection={navigateToForm}
        />
      )}

      {(state.currentScreen === 'form' || state.currentScreen === 'edit') && (
        <InspectionFormScreen
          inspectionId={state.selectedInspectionId}
          onBack={navigateToList}
          onSave={navigateToList}
        />
      )}
    </SafeAreaView>
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
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[600],
  },
});

export default App;
