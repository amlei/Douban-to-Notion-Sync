package task

import (
	"sync"
)

type BindTask struct {
	TaskID       string
	Platform     string
	Status       string // pending, scanned, logged_in, fetching_profile, scraping, bound, failed
	QRBase64     string
	UserID       string
	Profile      any
	Error        string
	ScrapePhase  string
	ScrapeCounts map[string]int64
	ch           chan struct{}
}

func NewBindTask(taskID, platform string) *BindTask {
	return &BindTask{
		TaskID:       taskID,
		Platform:     platform,
		Status:       "pending",
		ScrapeCounts: make(map[string]int64),
		ch:           make(chan struct{}, 1),
	}
}

func (t *BindTask) Notify() {
	select {
	case t.ch <- struct{}{}:
	default:
	}
}

func (t *BindTask) Wait() <-chan struct{} {
	return t.ch
}

type TaskManager struct {
	mu    sync.RWMutex
	tasks map[int64]map[string]*BindTask // user_id -> platform -> task
}

func NewTaskManager() *TaskManager {
	return &TaskManager{
		tasks: make(map[int64]map[string]*BindTask),
	}
}

func (m *TaskManager) CreateTask(userID int64, platform string) *BindTask {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.tasks[userID]; !ok {
		m.tasks[userID] = make(map[string]*BindTask)
	}

	taskID := generateTaskID()
	task := NewBindTask(taskID, platform)
	m.tasks[userID][platform] = task
	return task
}

func (m *TaskManager) GetTask(userID int64, platform string) *BindTask {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if platforms, ok := m.tasks[userID]; ok {
		return platforms[platform]
	}
	return nil
}

func (m *TaskManager) GetActiveTask(userID int64) *BindTask {
	m.mu.RLock()
	defer m.mu.RUnlock()

	platforms, ok := m.tasks[userID]
	if !ok {
		return nil
	}
	for _, task := range platforms {
		if task.Status != "idle" {
			return task
		}
	}
	return nil
}

func (m *TaskManager) ClearTasks(userID int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.tasks, userID)
}

func (m *TaskManager) ClearPlatformTask(userID int64, platform string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if platforms, ok := m.tasks[userID]; ok {
		delete(platforms, platform)
	}
}

func generateTaskID() string {
	// Simple 12-char hex ID
	return randomHex(6)
}

func randomHex(n int) string {
	const charset = "0123456789abcdef"
	b := make([]byte, n)
	for i := range b {
		b[i] = charset[i%16]
	}
	return string(b)
}
