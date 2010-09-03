import re
import copy
import logging
import simplejson
from KeyedObject import KeyedObject
import QualifierExceptions

from WaterlooCourseSection import WaterlooCourseSection
from BeautifulSoup import BeautifulSoup
from BeautifulSoup import NavigableString

def checkOptions( options, waterlooCourse ):
    hasTutorials = options["tutorials"]
    hasTests = options["tests"]
    hasOther = options["other"]

    if not hasTutorials and waterlooCourse.type.startswith("TUT"):
        return False
    if not hasTests and waterlooCourse.type.startswith("TST"):
        return False

    if not hasOther:
        for good in ("TST", "TUT", "LEC"):
            if waterlooCourse.type.startswith( good ):
                break
        else:
            return False
        
    return True

def checkAllCourses( courses, options ):
    requiredSections = set(e for e in options["sections"] if e)
    for course in courses:
        goodSection = None
        for section in course.sections:
            if section.sectionNum in requiredSections:
                goodSection = section
        if goodSection:
            course.sections = [e for e in course.sections if e.sectionNum in requiredSections]

        requiredSections -= set(e.sectionNum for e in course.sections )

            

    if len( requiredSections ) > 0:
        raise QualifierExceptions.MissingRequiredSectionsException( "Missing section(s) %s for %s" % 
            ( ",".join( requiredSections), courses[0].courseName ) )


def constructCourses(inputHTML, options, globalOptions):
    """Constructs Courses based on given input HTML"""

    courses = []
    soup = BeautifulSoup( inputHTML, convertEntities=BeautifulSoup.HTML_ENTITIES )
    try:
        mainTable = soup.findAll( name="table", limit=1 )[0]
    except IndexError:
        raise QualifierExceptions.CourseMissingException()
    courses = []
    for subject in mainTable.findAll( text="Subject" ):
        headerRow = subject.findParents( "tr" )[0]
        subjectRow = headerRow.findNextSibling( "tr" )
        details = [e.string.strip() for e in subjectRow.findAll( "td", align="center" )]
        if len( details ) < 2:
            continue


        waterlooCourse = WaterlooCourse()
        waterlooCourse.courseName = "%s %s" % (details[0], details[1] )
        if len( details ) == 4:
            try:
                waterlooCourse.creditWorth = float( details[2] )
            except ValueError:
                pass
            waterlooCourse.description= details[3]

        classTable = subjectRow.findNext( "table" )
        classHeaderRow = classTable.findNext( "th" ).parent
        classHeaders = [e.strip().lower() for e in classHeaderRow.findAll( text=re.compile(".*" ) ) if not e.isspace() ]

        classIndex = classHeaders.index( "class" )
        dateIndex = classHeaders.index( "time days/date" )
        compSecIndex = classHeaders.index( "comp sec" )
        campusIndex = classHeaders.index( "camp loc" )
        enrlCapIndex = classHeaders.index( "enrl cap" )
        enrlTotIndex = classHeaders.index( "enrl tot" )

        roomIndex = None
        instructorIndex = None
        rel1Index = None
        rel2Index = None
        try:
            roomIndex = classHeaders.index("bldg room" )
            instructorIndex = classHeaders.index( "instructor" )
        except IndexError:
            pass

        try:
            rel1Index = classHeaders.index("rel 1" )
            rel2Index = classHeaders.index("rel 2" )
        except IndexError:
            pass


        classRows = classHeaderRow.findNextSiblings( "tr" )
        for classRow in classRows:
            tds = classRow.findAll( "td" )

            texts = []
            for td in tds:
                tdText =  " ".join( e.strip() for e in td.contents if type(e) == NavigableString)
                texts.append(tdText)
                try:
                    colspan = int(td['colspan'])
                except KeyError:
                    colspan = 1

                #Make each row of uniform length, pad with empties
                if colspan != 1:
                    texts += ["" for x in xrange(colspan -1 )]

            blanks = len( [e for e in texts if not e] )

            if not texts[classIndex] and not texts[compSecIndex]:
                if lastValid:
                    lastSection = waterlooCourse.sections[-1]
                    if texts[dateIndex]:
                        lastSection.parseDateFromStr( texts[dateIndex] ) 
                    if texts[roomIndex] and texts[roomIndex] != lastSection.room:
                        lastSection.room = "%s / %s" % (lastSection.room, texts[roomIndex])

            elif len(texts) - blanks == 0:
                continue
            elif len( classHeaders ) - len( tds ) > 3:
                continue
            else:
                lastValid = False
                #ignore distance ed if we want
                if not globalOptions["show_distance_ed"]:
			if "DE" in texts[campusIndex] or "Online" in texts[roomIndex]:
				continue
                courseSection = WaterlooCourseSection( waterlooCourse )
                courseSection.uniqueName = texts[classIndex]
                courseSection.campus = texts[campusIndex]


                courseType, sectionNum = texts[compSecIndex].split()

                try:
                    texts[dateIndex].upper().index("TBA")
                    logging.info("Ignoring 'to be announced' %s section %s" % (waterlooCourse.uniqueName, sectionNum))
                    continue
                except ValueError:
                    pass

                try:
                    texts[dateIndex].upper().index("CANCEL")
                    logging.info("Ignoring cancelled %s section %s" % (waterlooCourse.uniqueName, sectionNum))
                    continue
                except ValueError:
                    pass

                if not waterlooCourse.type:
                    waterlooCourse.type = courseType
                elif waterlooCourse.type != courseType:
                    if checkOptions( options, waterlooCourse ):
                        courses.append( waterlooCourse )
                    waterlooCourse = copy.deepcopy( waterlooCourse )
                    waterlooCourse.sections = []
                    waterlooCourse.type = courseType

                #Skip tutorials if we don't want them
                courseSection.sectionNum = sectionNum
                courseSection.courseName = waterlooCourse.uniqueName
                courseSection.alternateName = texts[compSecIndex]
                courseSection.parseDateFromStr( texts[dateIndex] )
                if enrlTotIndex:
                    try:
                        courseSection.enrlTot = texts[enrlTotIndex]
                    except IndexError:
                        pass
                if enrlCapIndex:
                    try:
                        courseSection.enrlCap = texts[enrlCapIndex]
                    except IndexError:
                        pass

                if roomIndex:
                    try:
                        courseSection.room = texts[roomIndex]
                    except IndexError:
                        pass
                if instructorIndex:
                    try:
                        courseSection.instructor = texts[instructorIndex]
                        courseSection.setRateMyProfessorsInfo()

                    except IndexError:
                        pass
                if rel1Index and not texts[rel1Index].isspace():
                    try:
                        courseSection.related1 = texts[rel1Index]
                    except IndexError:
                        pass
                if rel2Index and not texts[rel2Index].isspace():
                    try:
                        courseSection.related2 = texts[rel2Index]
                    except IndexError:
                        pass

                try:
                    if globalOptions["show_full_courses"] == False and courseSection.full():
                        continue

                except (KeyError, ValueError), e:
                    pass

                #Check for minimum start and end
                try:
                    if globalOptions[ "start_later_than_hour" ] != "" and globalOptions["start_later_than_minute"] != "":
                       minTime = 60*60*int(globalOptions["start_later_than_hour"]) + 60*int(globalOptions["start_later_than_minute"] )
                       if globalOptions[ "start_later_than_hour" ] == "12":
                           minTime -= 12*60*60

                       if globalOptions['start_later_than_ampm'] == "PM":
                           minTime += 60*60*12

                       if not courseSection.startsAfter( minTime ):
                           continue
                except (KeyError, ValueError ), e:
                    pass

                try:
                    if globalOptions[ "ends_earlier_than_hour" ] != "" and globalOptions["ends_earlier_than_minute"] != "":
                       minTime = 60*60*int(globalOptions["ends_earlier_than_hour"]) + 60*int(globalOptions["ends_earlier_than_minute"] )
                       if globalOptions[ "ends_earlier_than_hour" ] == "12":
                           minTime -= 12*60*60

                       if globalOptions['ends_earlier_than_ampm'] == "PM":
                           minTime += 60*60*12

                       if not courseSection.endsEarlier( minTime ):
                           continue
                except (KeyError, ValueError ), e:
                    logging.info( e )
                    pass

                lastValid = True
                waterlooCourse.addSection( courseSection ) 

        if checkOptions( options, waterlooCourse ):
            courses.append( waterlooCourse )

    if len( courses ) == 0:
        raise QualifierExceptions.CourseMissingException()

    checkAllCourses( courses, options )


    return courses




class WaterlooCourse:
    def __init__( self ):
        self.courseName = ""
        self.alternateName = ""
        self.description = ""
        self.creditWorth = 0
        self.sections = []
        self.type = ""

    @property
    def uniqueName(self):
        return "%s %s" % (self.courseName, self.type )

    def dump( self ):
        return """WaterlooCourse: %(name)s (%(desc)s)""" % \
                {"name": self.uniqueName, "desc": self.description}

    def getJson( self ):
        return   {
                    "courseName": self.uniqueName,
                    "type": self.type,
                    "description": self.description,
                    "sections": dict( (e.uniqueName, e.getJson()) for e in self.sections ),
                    }



    def jsonDump( self ):
        return simplejson.dumps( self.getJson() )


    def addSection( self, section ):
        self.sections.append( section )


def test():
   f = open( "math135.htm", "r" ) 
   html = f.read()
   f.close()

   print [e.jsonDump() for e in constructCourses( html ) ]

if __name__ == "__main__":
    test()