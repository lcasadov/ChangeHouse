import { borderWidth, useTheme } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text, useBreakpoint } from '../../ui';

export interface Column<T> {
  key: string;
  /** Cabecera de la columna (en tarjetas, la etiqueta de cada dato). */
  header: string;
  value: (item: T) => string;
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Acción por fila (botón), bajo la tarjeta o en la última celda de la tabla. */
  renderAction?: (item: T) => ReactNode;
}

/**
 * Tabla en pantallas medianas y anchas; en pantallas estrechas cada fila pasa a ser una tarjeta
 * con «etiqueta: valor», de modo que nunca hace falta desplazarse en horizontal.
 */
export function DataTable<T>({ columns, items, keyOf, renderAction }: Readonly<DataTableProps<T>>) {
  const theme = useTheme();
  const compact = useBreakpoint() === 'compact';

  if (compact) {
    return (
      <View style={{ gap: theme.space[3] }}>
        {items.map((item) => (
          <View
            key={keyOf(item)}
            testID="data-card"
            style={{
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
              borderRadius: theme.radius.lg,
              borderWidth: borderWidth.thin,
              gap: theme.space[2],
              padding: theme.space[4],
            }}
          >
            {columns.map((column) => (
              <View key={column.key}>
                <Text variant="caption" tone="textMuted">
                  {column.header}
                </Text>
                <Text>{column.value(item)}</Text>
              </View>
            ))}
            {renderAction ? (
              <View style={{ paddingTop: theme.space[2] }}>{renderAction(item)}</View>
            ) : null}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      testID="data-table"
      role="grid"
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: theme.radius.lg,
        borderWidth: borderWidth.thin,
        overflow: 'hidden',
      }}
    >
      <View
        role="row"
        style={{
          backgroundColor: theme.color.surfaceMuted,
          flexDirection: 'row',
          gap: theme.space[3],
          padding: theme.space[3],
        }}
      >
        {columns.map((column) => (
          <View key={column.key} style={{ flex: 1 }} role="columnheader">
            <Text variant="label" tone="textMuted">
              {column.header}
            </Text>
          </View>
        ))}
        {renderAction ? <View style={{ flex: 1 }} /> : null}
      </View>
      {items.map((item) => (
        <View
          key={keyOf(item)}
          testID="data-row"
          role="row"
          style={{
            alignItems: 'center',
            borderTopColor: theme.color.border,
            borderTopWidth: borderWidth.thin,
            flexDirection: 'row',
            gap: theme.space[3],
            padding: theme.space[3],
          }}
        >
          {columns.map((column) => (
            <View key={column.key} style={{ flex: 1 }} role="cell">
              <Text>{column.value(item)}</Text>
            </View>
          ))}
          {renderAction ? <View style={{ flex: 1 }}>{renderAction(item)}</View> : null}
        </View>
      ))}
    </View>
  );
}
