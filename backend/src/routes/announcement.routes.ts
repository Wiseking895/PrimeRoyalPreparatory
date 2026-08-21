import { Router } from 'express'
import {
  createAnnouncementHandler,
  listAnnouncementsHandler,
  getAnnouncementHandler,
  updateAnnouncementHandler,
  deleteAnnouncementHandler,
} from '../controllers/announcement.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('announcements.view'), listAnnouncementsHandler)
router.get('/:id', requirePermission('announcements.view'), getAnnouncementHandler)
router.post('/', requirePermission('announcements.manage'), createAnnouncementHandler)
router.patch('/:id', requirePermission('announcements.manage'), updateAnnouncementHandler)
router.delete('/:id', requirePermission('announcements.manage'), deleteAnnouncementHandler)

export const announcementRouter = router
