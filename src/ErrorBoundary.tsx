import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

type Props = { children: React.ReactNode; fallbackLabel?: string };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.container}>
        <View style={s.card}>
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.label}>{this.props.fallbackLabel ?? 'An unexpected error occurred.'}</Text>
          <ScrollView style={s.errorBox} showsVerticalScrollIndicator={false}>
            <Text style={s.errorText}>{this.state.error?.message}</Text>
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={this.reset}>
            <Text style={s.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#0a0a0a', borderRadius: 20, padding: 24, width: '100%',
    alignItems: 'center', borderWidth: 1, borderColor: '#1a1a2a',
  },
  icon:  { fontSize: 40, marginBottom: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  label: { color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  errorBox: {
    backgroundColor: '#000', borderRadius: 10, padding: 12,
    maxHeight: 120, width: '100%', marginBottom: 20,
    borderWidth: 1, borderColor: '#111',
  },
  errorText: { color: '#444', fontSize: 12, fontFamily: 'monospace' },
  btn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 28,
    paddingVertical: 13, borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
