import { Router } from 'express'
import {
  listNotificationsHandler,
  unreadCountHandler,
  markReadHandler,
  markAllReadHandler,
} from '../controllers/notification.controller'
import { requireAuth } from '../middleware/require-auth'

const router = Router()

router.use(requireAuth)
router.get('/', listNotificationsHandler)
router.get('/unread-count', unreadCountHandler)
router.patch('/read-all', markAllReadHandler)
router.patch('/:id/read', markReadHandler)

export const notificationRouter = router
