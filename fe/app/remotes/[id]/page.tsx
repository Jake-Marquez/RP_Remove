'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, Button, Card, Stack, Group, TextInput, Loader, Center, Alert, ActionIcon, Modal, Code, NumberInput, Checkbox, Textarea, Divider } from '@mantine/core';
import { IconArrowLeft, IconAlertCircle, IconCheck, IconEdit, IconX, IconTrash, IconPencil, IconChevronDown, IconChevronUp, IconPlayerPlay } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { use } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useRouter } from 'next/navigation';

interface FunctionInput {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

interface DeviceFunction {
  id: string;
  name: string;
  description: string;
  inputs: FunctionInput[];
}

interface GroupedFunction extends DeviceFunction {
  deviceHost: string;
  devicePort: number;
  remoteFunctionId: number;
}

export default function RemoteDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const remoteId = parseInt(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [expandedFunction, setExpandedFunction] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [calling, setCalling] = useState<number | null>(null);
  const [callResult, setCallResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const remote = useLiveQuery(() => db.remotes.get(remoteId));
  const remoteFunctions = useLiveQuery(() => db.remoteFunctions.where('remoteId').equals(remoteId).toArray());
  const devices = useLiveQuery(() => db.devices.toArray());

  const [groupedFunctions, setGroupedFunctions] = useState<Map<string, { functions: GroupedFunction[]; isOnline: boolean; deviceName: string; apiKey?: string }>>(new Map());

  useEffect(() => {
    loadAllFunctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteFunctions, devices]);

  const loadAllFunctions = async () => {
    if (!remoteFunctions || !devices) {
      setLoading(false);
      return;
    }

    const grouped = new Map<string, { functions: GroupedFunction[]; isOnline: boolean; deviceName: string; apiKey?: string }>();

    for (const rf of remoteFunctions) {
      const hostPort = `${rf.deviceHost}:${rf.devicePort}`;
      const device = devices.find(d => d.hostPort === hostPort);

      if (!device || !device.apiKey) continue;

      const isOnline = Date.now() - new Date(device.lastSeen).getTime() < 60000;

      try {
        const response = await fetch(`/api/device/${rf.deviceHost}/${rf.devicePort}/functions`, {
          headers: { 'X-API-Key': device.apiKey },
        });

        if (response.ok) {
          const data = await response.json();
          const func = data.functions.find((f: DeviceFunction) => f.id === rf.functionId);

          if (func) {
            const groupedFunc: GroupedFunction = {
              ...func,
              deviceHost: rf.deviceHost,
              devicePort: rf.devicePort,
              remoteFunctionId: rf.id!,
            };

            if (!grouped.has(hostPort)) {
              grouped.set(hostPort, {
                functions: [],
                isOnline,
                deviceName: device.name,
                apiKey: device.apiKey,
              });
            }

            grouped.get(hostPort)!.functions.push(groupedFunc);
          }
        }
      } catch (err) {
        console.error(`Failed to load functions for ${hostPort}:`, err);
      }
    }

    setGroupedFunctions(grouped);
    setLoading(false);
  };

  const handleRemoveFunction = async (remoteFunctionId: number) => {
    try {
      await db.remoteFunctions.delete(remoteFunctionId);
    } catch (err) {
      console.error('Failed to remove function:', err);
    }
  };

  const handleDeleteRemote = async () => {
    setDeleting(true);
    try {
      await db.remoteFunctions.where('remoteId').equals(remoteId).delete();
      await db.remotes.delete(remoteId);
      router.push('/remotes');
    } catch (err) {
      console.error('Failed to delete remote:', err);
      setDeleting(false);
    }
  };

  const handleEditName = async () => {
    if (!editedName.trim()) return;

    setSavingName(true);
    try {
      await db.remotes.update(remoteId, {
        name: editedName.trim(),
        updated: new Date().toISOString(),
      });
      setShowEditNameModal(false);
      setEditedName('');
    } catch (err) {
      console.error('Failed to update name:', err);
    } finally {
      setSavingName(false);
    }
  };

  const toggleGroup = (hostPort: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(hostPort)) {
      newCollapsed.delete(hostPort);
    } else {
      newCollapsed.add(hostPort);
    }
    setCollapsedGroups(newCollapsed);
  };

  const handleFunctionClick = (func: GroupedFunction) => {
    if (editMode) return;

    // Toggle expansion
    if (expandedFunction === func.remoteFunctionId) {
      setExpandedFunction(null);
      setInputValues({});
    } else {
      setExpandedFunction(func.remoteFunctionId);
      setInputValues({});
      setCallResult(null);
    }
  };

  const handleCallFunction = async (func: GroupedFunction, showModal: boolean = true) => {
    const hostPort = `${func.deviceHost}:${func.devicePort}`;
    const group = groupedFunctions.get(hostPort);
    if (!group?.apiKey) return;

    setCalling(func.remoteFunctionId);
    setCallResult(null);
    setError(null);

    try {
      const inputs: Record<string, any> = {};
      func.inputs.forEach(input => {
        const value = inputValues[input.name];
        const inputType = input.type.toLowerCase();

        if (inputType !== 'boolean' && inputType !== 'bool' && (value === undefined || value === '')) {
          return;
        }

        if (inputType === 'boolean' || inputType === 'bool') {
          inputs[input.name] = value === true;
        } else if (inputType === 'number' || inputType === 'int' || inputType === 'integer' || inputType === 'float') {
          inputs[input.name] = value;
        } else if (inputType === 'json' || inputType === 'object' || inputType === 'array') {
          try {
            inputs[input.name] = JSON.parse(value);
          } catch (e) {
            inputs[input.name] = value;
          }
        } else {
          inputs[input.name] = value;
        }
      });

      const response = await fetch(`/api/device/${func.deviceHost}/${func.devicePort}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': group.apiKey,
        },
        body: JSON.stringify({
          functionId: func.id,
          inputs,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to call function');
      }

      const result = await response.json();

      if (showModal) {
        setCallResult(result);
        setShowResultModal(true);
        setExpandedFunction(null);
        setInputValues({});
      } else {
        // Show success toast for collapsed functions
        notifications.show({
          title: 'Success',
          message: `${func.name} executed successfully`,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to call function';

      if (showModal) {
        setError(errorMessage);
      } else {
        // Show error toast for collapsed functions
        notifications.show({
          title: 'Error',
          message: errorMessage,
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
      }
      console.error('Call function error:', err);
    } finally {
      setCalling(null);
    }
  };

  const handleInputChange = (inputName: string, value: any) => {
    setInputValues(prev => ({
      ...prev,
      [inputName]: value,
    }));
  };

  const renderInputField = (input: FunctionInput) => {
    const inputType = input.type.toLowerCase();
    const value = inputValues[input.name];

    if (inputType === 'boolean' || inputType === 'bool') {
      return (
        <Checkbox
          key={input.name}
          label={input.name}
          description={input.description}
          checked={value === true}
          onChange={(e) => handleInputChange(input.name, e.currentTarget.checked)}
        />
      );
    }

    if (inputType === 'number' || inputType === 'int' || inputType === 'integer' || inputType === 'float') {
      return (
        <NumberInput
          key={input.name}
          label={input.name}
          description={input.description}
          placeholder={`Enter ${input.type}${input.required ? ' (required)' : ''}`}
          required={input.required}
          value={value === undefined || value === '' ? undefined : Number(value)}
          onChange={(val) => handleInputChange(input.name, val)}
          allowDecimal={inputType === 'float' || inputType === 'number'}
          decimalScale={inputType === 'float' || inputType === 'number' ? 2 : 0}
        />
      );
    }

    if (inputType === 'json' || inputType === 'object' || inputType === 'array') {
      return (
        <Textarea
          key={input.name}
          label={input.name}
          description={input.description || 'Enter valid JSON'}
          placeholder={`{"key": "value"}${input.required ? ' (required)' : ''}`}
          required={input.required}
          value={value || ''}
          onChange={(e) => handleInputChange(input.name, e.currentTarget.value)}
          minRows={3}
          autosize
        />
      );
    }

    return (
      <TextInput
        key={input.name}
        label={input.name}
        description={input.description}
        placeholder={`Enter ${input.type}${input.required ? ' (required)' : ''}`}
        required={input.required}
        value={value || ''}
        onChange={(e) => handleInputChange(input.name, e.currentTarget.value)}
      />
    );
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading remote...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (!remote) {
    return (
      <Container size="md" py="xl">
        <Center py="xl">
          <Text c="dimmed">Remote not found</Text>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          <Group>
            <ActionIcon
              component={Link}
              href="/remotes"
              variant="subtle"
              size="lg"
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Title
              order={2}
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {remote.name}
            </Title>
          </Group>
          <Group justify="center" gap="xs">
            <Button
              variant="light"
              leftSection={<IconPencil size={18} />}
              onClick={() => {
                setEditedName(remote.name);
                setShowEditNameModal(true);
              }}
              size="sm"
            >
              Rename
            </Button>
            <Button
              variant={editMode ? 'filled' : 'light'}
              leftSection={<IconEdit size={18} />}
              onClick={() => setEditMode(!editMode)}
              size="sm"
            >
              {editMode ? 'Done' : 'Edit'}
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={18} />}
              onClick={() => setShowDeleteModal(true)}
              size="sm"
            >
              Delete
            </Button>
          </Group>
        </Stack>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        {groupedFunctions.size === 0 ? (
          <Card withBorder p="xl">
            <Center>
              <Text c="dimmed">No functions added to this remote yet</Text>
            </Center>
          </Card>
        ) : (
          <Stack gap="lg">
            {Array.from(groupedFunctions.entries()).map(([hostPort, group]) => {
              const isCollapsed = collapsedGroups.has(hostPort);

              return (
                <div key={hostPort}>
                  <div
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: 'var(--mantine-color-body)',
                      zIndex: 10,
                      padding: '12px 0',
                      borderBottom: '1px solid var(--mantine-color-dark-4)',
                      marginBottom: isCollapsed ? 0 : '12px',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleGroup(hostPort)}
                  >
                    <Group justify="space-between">
                      <Group gap="xs">
                        {isCollapsed ? <IconChevronDown size={18} /> : <IconChevronUp size={18} />}
                        <Text fw={600} c={group.isOnline ? undefined : 'dimmed'}>
                          {group.deviceName}
                        </Text>
                      </Group>
                      <Text size="xs" c={group.isOnline ? 'dimmed' : 'red'}>
                        {group.isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </Group>
                  </div>

                  {!isCollapsed && (
                    <Stack gap="sm">
                      {group.functions.map(func => {
                        const isExpanded = expandedFunction === func.remoteFunctionId;
                        const isCalling = calling === func.remoteFunctionId;

                        return (
                          <Card
                            key={func.remoteFunctionId}
                            withBorder
                            padding="md"
                            style={{
                              cursor: editMode ? 'default' : (group.isOnline ? 'pointer' : 'not-allowed'),
                              opacity: group.isOnline ? 1 : 0.5,
                            }}
                          >
                            <Stack gap="md">
                              <Group
                                justify="space-between"
                                wrap="nowrap"
                                onClick={() => !editMode && group.isOnline && handleFunctionClick(func)}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <Text fw={500}>{func.name}</Text>
                                  {func.description && (
                                    <Text size="sm" c="dimmed" lineClamp={isExpanded ? undefined : 1}>
                                      {func.description}
                                    </Text>
                                  )}
                                </div>
                                <Group gap="xs">
                                  {!isExpanded && !editMode && group.isOnline && (
                                    <ActionIcon
                                      variant="light"
                                      color="blue"
                                      loading={isCalling}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCallFunction(func, false);
                                      }}
                                    >
                                      <IconPlayerPlay size={18} />
                                    </ActionIcon>
                                  )}
                                  {editMode && (
                                    <ActionIcon
                                      color="red"
                                      variant="light"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveFunction(func.remoteFunctionId);
                                      }}
                                    >
                                      <IconX size={18} />
                                    </ActionIcon>
                                  )}
                                </Group>
                              </Group>

                              {isExpanded && !editMode && (
                                <Stack gap="sm" onClick={(e) => e.stopPropagation()}>
                                  {func.inputs.length > 0 ? (
                                    <>
                                      <Divider />
                                      <Text size="sm" fw={500}>Parameters:</Text>
                                      {func.inputs.map(input => renderInputField(input))}
                                    </>
                                  ) : (
                                    <Text size="sm" c="dimmed">No parameters required</Text>
                                  )}
                                  <Button
                                    onClick={() => handleCallFunction(func)}
                                    loading={isCalling}
                                    disabled={isCalling}
                                    size="md"
                                    fullWidth
                                  >
                                    {isCalling ? 'Calling...' : 'Execute Function'}
                                  </Button>
                                </Stack>
                              )}
                            </Stack>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}
                </div>
              );
            })}
          </Stack>
        )}
      </Stack>

      {/* Result Modal */}
      <Modal
        opened={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={<Group gap="xs"><IconCheck size={20} color="green" /><Text fw={600}>Function Result</Text></Group>}
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Function executed successfully
          </Text>
          <Code block style={{ maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(callResult, null, 2)}
          </Code>
          <Button onClick={() => setShowResultModal(false)} fullWidth>
            Close
          </Button>
        </Stack>
      </Modal>

      {/* Delete Remote Modal */}
      <Modal
        opened={showDeleteModal}
        onClose={() => !deleting && setShowDeleteModal(false)}
        title={<Text fw={600}>Delete Remote</Text>}
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete &quot;{remote.name}&quot;? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteRemote} loading={deleting} disabled={deleting}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Name Modal */}
      <Modal
        opened={showEditNameModal}
        onClose={() => !savingName && setShowEditNameModal(false)}
        title={<Text fw={600}>Edit Remote Name</Text>}
      >
        <Stack gap="md">
          <TextInput
            label="Remote Name"
            placeholder="Enter new name"
            value={editedName}
            onChange={(e) => setEditedName(e.currentTarget.value)}
            required
            disabled={savingName}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !savingName && editedName.trim()) {
                handleEditName();
              }
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowEditNameModal(false)} disabled={savingName}>
              Cancel
            </Button>
            <Button onClick={handleEditName} loading={savingName} disabled={savingName || !editedName.trim()}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
